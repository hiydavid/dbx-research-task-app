"""
Research Job Runner for Lakeflow Serverless Jobs

This module is the entry point for deep research tasks that run asynchronously
on Databricks serverless compute. It:
1. Receives task_id and scope as parameters
2. Connects to Lakebase to track progress
3. Runs the research agent with extended instructions
4. Writes final markdown output to UC Volume
5. Updates task status on completion/failure
"""

import argparse
import json
import os
import uuid
from datetime import datetime
from typing import Optional

import psycopg2
from databricks.sdk import WorkspaceClient


class LakebaseConnection:
    """
    Manages connection to Lakebase (PostgreSQL) using Databricks OAuth.

    The Lakeflow job runs as a service principal, and WorkspaceClient()
    automatically uses that identity to generate database credentials.
    """

    def __init__(self, instance_name: str):
        self.instance_name = instance_name
        self.w = WorkspaceClient()
        self._conn: Optional[psycopg2.extensions.connection] = None

    def _get_connection(self) -> psycopg2.extensions.connection:
        """Get or create a database connection with fresh OAuth token."""
        if self._conn is not None and not self._conn.closed:
            return self._conn

        # Get database instance info
        instance = self.w.database.get_database_instance(name=self.instance_name)

        # Generate OAuth credential
        cred = self.w.database.generate_database_credential(
            request_id=str(uuid.uuid4()),
            instance_names=[self.instance_name]
        )

        # Get service principal client ID (used as Postgres username)
        # The SP needs a matching Postgres role with permissions on ai_chatbot schema
        sp_client_id = os.environ.get("DATABRICKS_CLIENT_ID", "")

        self._conn = psycopg2.connect(
            host=instance.read_write_dns,
            dbname="databricks_postgres",
            user=sp_client_id,
            password=cred.token,
            sslmode="require"
        )
        return self._conn

    def execute(self, query: str, params: tuple = ()) -> list:
        """Execute a query and return results."""
        conn = self._get_connection()
        with conn.cursor() as cur:
            cur.execute(query, params)
            if cur.description:
                return cur.fetchall()
            return []

    def execute_update(self, query: str, params: tuple = ()):
        """Execute an update query and commit."""
        conn = self._get_connection()
        with conn.cursor() as cur:
            cur.execute(query, params)
        conn.commit()

    def close(self):
        """Close the database connection."""
        if self._conn is not None:
            self._conn.close()
            self._conn = None


class ResearchJobRunner:
    """
    Runs a deep research task with progress tracking and cancellation support.
    """

    def __init__(self, task_id: str, db: LakebaseConnection, volume_path: str):
        self.task_id = task_id
        self.db = db
        self.volume_path = volume_path
        self.w = WorkspaceClient()

    def update_status(
        self,
        status: str,
        job_run_id: Optional[str] = None,
        output_path: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        """Update task status in database."""
        updates = ["status = %s", "updated_at = NOW()"]
        params = [status]

        if job_run_id:
            updates.append("job_run_id = %s")
            params.append(job_run_id)
        if output_path:
            updates.append("output_path = %s")
            params.append(output_path)
        if error_message:
            updates.append("error_message = %s")
            params.append(error_message)

        if status in ("completed", "failed", "cancelled"):
            updates.append("completed_at = NOW()")

        params.append(self.task_id)

        query = f"""
            UPDATE ai_chatbot."ResearchTask"
            SET {', '.join(updates)}
            WHERE id = %s
        """
        self.db.execute_update(query, tuple(params))

    def add_progress(self, step: str, message: str):
        """Append a progress entry to the task."""
        progress_entry = json.dumps({
            "step": step,
            "message": message,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })

        query = """
            UPDATE ai_chatbot."ResearchTask"
            SET progress = COALESCE(progress, '[]'::jsonb) || %s::jsonb,
                updated_at = NOW()
            WHERE id = %s
        """
        self.db.execute_update(query, (progress_entry, self.task_id))
        print(f"[Progress] {step}: {message}")

    def check_cancellation(self) -> bool:
        """Check if the task has been cancelled."""
        result = self.db.execute(
            'SELECT status FROM ai_chatbot."ResearchTask" WHERE id = %s',
            (self.task_id,)
        )
        if result:
            return result[0][0] == "cancelled"
        return False

    def write_output(self, content: str) -> str:
        """Write markdown output to UC Volume and return the path."""
        output_path = f"{self.volume_path}/{self.task_id}.md"

        # Write to UC Volume using Databricks SDK
        self.w.files.upload(
            output_path,
            content.encode("utf-8"),
            overwrite=True
        )

        return output_path

    def run(self, scope: dict):
        """
        Execute the research task.

        Args:
            scope: Research scope containing topic, questions, depth, etc.
        """
        try:
            # Mark as running
            job_run_id = os.environ.get("DATABRICKS_JOB_RUN_ID", "unknown")
            self.update_status("running", job_run_id=job_run_id)
            self.add_progress("started", "Research job initialized")

            # Check for cancellation
            if self.check_cancellation():
                self.add_progress("cancelled", "Task was cancelled before starting")
                return

            # Extract scope parameters
            topic = scope.get("topic", "Unknown topic")
            questions = scope.get("questions", [])
            depth = scope.get("depth", "standard")

            self.add_progress("analyzing", f"Analyzing research topic: {topic}")

            # TODO: Implement actual research logic using the agent
            # For MVP, we'll create a placeholder output
            # In the full implementation, this would:
            # 1. Initialize the research agent with extended instructions
            # 2. Run iterative research loops
            # 3. Use web search and other tools
            # 4. Synthesize findings into a report

            # Check for cancellation periodically
            if self.check_cancellation():
                self.add_progress("cancelled", "Task was cancelled during research")
                return

            self.add_progress("researching", f"Researching {len(questions)} questions")

            # Simulate research steps
            for i, question in enumerate(questions):
                if self.check_cancellation():
                    self.add_progress("cancelled", f"Task was cancelled at question {i+1}")
                    return
                self.add_progress(f"question_{i+1}", f"Investigating: {question}")

            self.add_progress("synthesizing", "Synthesizing research findings")

            # Generate output markdown
            output_content = self._generate_research_output(topic, questions, depth)

            self.add_progress("writing", "Writing research report")
            output_path = self.write_output(output_content)

            # Mark as completed
            self.update_status("completed", output_path=output_path)
            self.add_progress("completed", f"Research complete. Output: {output_path}")

        except Exception as e:
            error_msg = str(e)
            print(f"[Error] Research job failed: {error_msg}")
            self.update_status("failed", error_message=error_msg)
            self.add_progress("failed", f"Research failed: {error_msg}")
            raise

    def _generate_research_output(self, topic: str, questions: list, depth: str) -> str:
        """
        Generate research output markdown.

        TODO: Replace with actual agent-driven research.
        """
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

        questions_section = "\n".join([f"- {q}" for q in questions]) if questions else "- No specific questions provided"

        return f"""# Research Report: {topic}

**Generated:** {now}
**Research Depth:** {depth}
**Task ID:** {self.task_id}

## Research Questions

{questions_section}

## Executive Summary

This is a placeholder research report. In the full implementation, this section would contain
an executive summary synthesized from the research findings.

## Detailed Findings

### Section 1: Background

*Research content would appear here...*

### Section 2: Key Insights

*Research content would appear here...*

### Section 3: Analysis

*Research content would appear here...*

## Sources

*List of sources consulted during research would appear here...*

## Methodology

This research was conducted using:
- Web search for current information
- Analysis of relevant documentation
- Synthesis of multiple sources

---

*This report was generated by the Research Task Manager.*
"""


def main():
    """Entry point for the Lakeflow job."""
    parser = argparse.ArgumentParser(description="Run a deep research task")
    parser.add_argument("--task-id", required=True, help="Research task ID")
    parser.add_argument("--scope", required=True, help="JSON-encoded research scope")
    args = parser.parse_args()

    # Parse scope
    scope = json.loads(args.scope)

    # Get configuration from environment
    instance_name = os.environ.get("LAKEBASE_INSTANCE_NAME")
    volume_path = os.environ.get("UC_VOLUME_PATH", "/Volumes/users/david_huang/research_outputs")

    if not instance_name:
        raise ValueError("LAKEBASE_INSTANCE_NAME environment variable is required")

    print(f"[Research Job] Starting task: {args.task_id}")
    print(f"[Research Job] Scope: {scope}")
    print(f"[Research Job] Volume path: {volume_path}")

    # Initialize database connection
    db = LakebaseConnection(instance_name)

    try:
        runner = ResearchJobRunner(args.task_id, db, volume_path)
        runner.run(scope)
    finally:
        db.close()

    print(f"[Research Job] Task {args.task_id} completed")


if __name__ == "__main__":
    main()
