const interactiveSelector = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='textbox']",
  "[role='slider']",
  "[role='listbox']",
  "[role='grid']",
  "[role='tablist']",
  "[data-capture-arrows]",
  "[data-capture-shortcuts]",
].join(",");

export function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element && target.closest(interactiveSelector) !== null
  );
}

export function shouldIgnorePresentationShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    return true;
  }

  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return true;
  }

  return isInteractiveTarget(event.target);
}

export function isSpaceKey(event: KeyboardEvent) {
  return (
    event.code === "Space" || event.key === " " || event.key === "Spacebar"
  );
}
