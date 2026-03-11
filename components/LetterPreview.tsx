import { parseLetterBlocks } from "@/lib/letter-format";

interface LetterPreviewProps {
  letterText: string;
  className?: string;
}

export function LetterPreview({ letterText, className = "" }: LetterPreviewProps) {
  const blocks = parseLetterBlocks(letterText);

  return (
    <div
      className={`rounded-[28px] border border-[#d8e1da] bg-[#fffef8] px-6 py-7 shadow-[0_18px_45px_rgba(18,35,31,0.08)] sm:px-10 sm:py-10 ${className}`.trim()}
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <div className="space-y-5 text-[15px] leading-8 text-[#1d2d2a] sm:text-[16px]">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            return (
              <h4
                key={`heading-${index}`}
                className="pt-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-[#4b635c]"
                style={{ fontFamily: 'var(--font-dm-serif), Georgia, "Times New Roman", serif' }}
              >
                {block.text}
              </h4>
            );
          }

          if (block.type === "list") {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag
                key={`list-${index}`}
                className={`space-y-2 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`item-${index}-${itemIndex}`} className="pl-1">
                    {item}
                  </li>
                ))}
              </ListTag>
            );
          }

          return (
            <div key={`text-${index}`} className="whitespace-pre-line">
              {block.lines.join("\n")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
