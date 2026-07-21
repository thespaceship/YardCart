// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ConfirmSubmit from "@/components/ConfirmSubmit";

// jsdom implements neither of these form methods; stub them so we can observe the submit and let
// the (always-valid) test form pass validation.
beforeAll(() => {
  HTMLFormElement.prototype.requestSubmit = vi.fn();
  HTMLFormElement.prototype.reportValidity = vi.fn(() => true);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderInForm(props: Partial<React.ComponentProps<typeof ConfirmSubmit>> = {}) {
  return render(
    <form>
      <ConfirmSubmit
        label="Subscribe"
        title="Start the Pro plan?"
        message="You'll be charged $149.00/mo."
        confirmLabel="Continue to checkout"
        {...props}
      />
    </form>
  );
}

describe("ConfirmSubmit", () => {
  it("does not submit on the first click — it opens a confirmation dialog instead", () => {
    renderInForm();
    // no dialog until asked
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("Start the Pro plan?");
    expect(dialog.textContent).toContain("$149.00/mo");
    // crucially, the form has NOT been submitted just because they clicked the tier button
    expect(HTMLFormElement.prototype.requestSubmit).not.toHaveBeenCalled();
  });

  it("Cancel closes the dialog without submitting", () => {
    renderInForm();
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(HTMLFormElement.prototype.requestSubmit).not.toHaveBeenCalled();
  });

  it("Confirm submits the form exactly once", () => {
    renderInForm();
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to checkout" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(HTMLFormElement.prototype.requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("enforces native form validity before opening (e.g. the delete-account name match)", () => {
    (HTMLFormElement.prototype.reportValidity as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    renderInForm();

    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    // invalid form → no dialog, no submit
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(HTMLFormElement.prototype.requestSubmit).not.toHaveBeenCalled();
  });

  it("when disabled, shows the disabled label and can't open the dialog", () => {
    renderInForm({ disabled: true, disabledLabel: "Current plan" });
    const btn = screen.getByRole("button", { name: "Current plan" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    fireEvent.click(btn);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
