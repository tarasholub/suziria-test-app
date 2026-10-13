import { expect, test } from "@playwright/test";
import { mockApi, sendMessage } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
});

test("renders empty state, provider switcher and MCP panel", async ({ page }) => {
  await expect(page.getByText("Чим допомогти?")).toBeVisible();

  // provider switcher reflects mocked availability
  const select = page.getByRole("combobox", { name: "Модель" });
  await expect(select).toHaveValue("google");
  await expect(select.locator("option", { hasText: "OpenAI" })).toBeDisabled();

  // MCP panel: connected server with tools, failed server with readable error
  await expect(page.getByText("Filesystem (read-only)")).toBeVisible();
  await expect(page.getByText("2 інструм.")).toBeVisible();
  await expect(page.getByText("HTTP 401: missing Authorization header")).toBeVisible();
});

test("sends a message: streams markdown answer and expandable tool call", async ({ page }) => {
  await sendMessage(page, "Які файли в sandbox?");

  // user bubble (scoped to main — the sidebar shows the same text as the title)
  await expect(page.getByRole("main").getByText("Які файли в sandbox?")).toBeVisible();

  // assistant markdown (bold rendered, not literal **)
  await expect(page.locator("strong", { hasText: "два файли" })).toBeVisible();

  // tool block: server badge + tool name + success state
  const toolBlock = page.getByRole("button", { name: /list_directory/ });
  await expect(toolBlock).toBeVisible();
  await expect(toolBlock.getByText("виконано")).toBeVisible();

  // expands to show params and result
  await toolBlock.click();
  await expect(page.getByText("Параметри")).toBeVisible();
  await expect(page.getByText('"path": "sandbox"')).toBeVisible();
  await expect(page.getByText("notes.md\\nteam.json")).toBeVisible();
});

test("chat history: saved, renamed, deleted with confirmation", async ({ page }) => {
  await sendMessage(page, "Перший чат для історії");
  await expect(page.locator("strong", { hasText: "два файли" })).toBeVisible();

  // saved in the sidebar with auto title
  const row = page.locator("nav .group", { hasText: "Перший чат для історії" });
  await expect(row).toBeVisible();

  // rename via pencil
  await row.getByTitle("Перейменувати чат").click();
  await page.getByRole("textbox", { name: "Нова назва чату" }).fill("Моя назва");
  await page.keyboard.press("Enter");
  await expect(page.locator("nav .group", { hasText: "Моя назва" })).toBeVisible();

  // delete is two-step: ✕ → «Точно?»
  const renamed = page.locator("nav .group", { hasText: "Моя назва" });
  await renamed.getByTitle("Видалити чат").click();
  await renamed.getByTitle("Підтвердити видалення").click();
  await expect(page.locator("nav .group", { hasText: "Моя назва" })).toHaveCount(0);
  await expect(page.getByText("Історія порожня")).toBeVisible();
});

test("MCP panel toggle disables a server via PATCH", async ({ page }) => {
  const patch = page.waitForRequest(
    (r) => r.url().includes("/api/mcp") && r.method() === "PATCH",
  );
  // the checkbox is sr-only; click its visible switch via the label
  const card = page
    .locator("aside div.rounded-lg")
    .filter({ hasText: "Filesystem (read-only)" });
  await card.locator("label").click();
  const req = await patch;
  expect(req.postDataJSON()).toEqual({ id: "filesystem", enabled: false });
});
