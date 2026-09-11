interface Props { src: string; label: string; size: number }
export default function QRCodeImage({ src, label, size }: Props) {
  const px = size && size > 0 ? size : 160;
  return (
    <figure className="inline-flex flex-col items-center gap-2">
      <img src={src} alt={label || "QR code"} width={px} height={px} className="rounded-md bg-background p-2 ring-1 ring-border" />
      {label ? <figcaption className="text-sm text-muted-foreground">{label}</figcaption> : null}
    </figure>
  );
}
