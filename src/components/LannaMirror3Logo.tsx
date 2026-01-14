import Image from 'next/image';

type LannaMirror3LogoProps = {
  className?: string;
};

const LannaMirror3Logo: React.FC<LannaMirror3LogoProps> = ({ className = 'h-8 w-auto' }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.svg"
        alt="LannaMirror3"
        width={32}
        height={32}
        className="h-full w-auto"
      />
      <span className="font-bold text-xl tracking-tight">LANNAMIRROR3</span>
    </div>
  );
};

export { LannaMirror3Logo };
