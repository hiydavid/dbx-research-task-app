import { test, expect } from '../fixtures';
import { ChatPage } from '../pages/chat';
import { skipInEphemeralMode } from '../helpers';

test.describe('Research lifecycle', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    skipInEphemeralMode(test);
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test('planner -> approve plan -> execute -> result markdown -> rerun', async ({
    page,
  }) => {
    await chatPage.sendUserMessage(
      'Create a research plan to evaluate market demand for premium analytics tooling in fintech.',
    );
    await chatPage.isGenerationComplete();

    await expect(page.getByTestId('approve-plan-button')).toBeVisible();
    await page.getByTestId('approve-plan-button').click();

    await expect(page.getByTestId('start-research-button')).toBeVisible();
    await page.getByTestId('start-research-button').click();

    await expect
      .poll(async () => {
        const text = await page.getByTestId('research-run-status').textContent();
        return text?.trim();
      })
      .toBe('succeeded');

    await page.getByRole('button', { name: 'result' }).click();
    await expect(page.getByTestId('research-result-markdown')).toContainText(
      'Research Result',
    );

    await expect(page.getByTestId('rerun-button')).toBeVisible();
    await page.getByTestId('rerun-button').click();
    await expect(page.getByTestId('research-run-status')).toBeVisible();
  });
});
