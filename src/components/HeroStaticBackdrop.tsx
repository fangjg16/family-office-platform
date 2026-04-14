/**
 * Spline 不可用时（无 WebGL / 沙箱）的 Hero 背景：同色系渐变 + 轻网格，不依赖 3D。
 */
export function HeroStaticBackdrop() {
  return (
    <div
      className="absolute inset-0 bg-[hsl(240_43%_5%)]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(59,130,246,0.22),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_80%,rgba(14,165,233,0.12),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_10%_60%,rgba(99,102,241,0.08),transparent_45%)]" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
