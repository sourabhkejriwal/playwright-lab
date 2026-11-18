/** Flashcard and quiz text is plain, with code in `backticks`. */
export default function CodeText({ text }: { text: string }) {
  return text.split(/`([^`]+)`/).map((part, index) =>
    index % 2 === 1 ? (
      <code
        key={index}
        className="rounded-[4px] border border-line bg-raised px-1 font-mono text-[0.875em] break-words text-purple"
      >
        {part}
      </code>
    ) : (
      part
    ),
  );
}
