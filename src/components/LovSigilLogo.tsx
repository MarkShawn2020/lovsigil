import Image from 'next/image';

type LovSigilLogoProps = {
  className?: string;
};

const LovSigilLogo: React.FC<LovSigilLogoProps> = ({ className = 'h-8 w-auto' }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.png"
        alt="LovSigil"
        width={32}
        height={32}
        className="h-full w-auto"
      />
      <span className="font-bold text-xl tracking-tight">LovSigil</span>
    </div>
  );
};

export { LovSigilLogo };
