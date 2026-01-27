import Image from 'next/image';

type LovSigilIconProps = {
  className?: string;
};

const LovSigilIcon: React.FC<LovSigilIconProps> = ({ className = 'h-8 w-8' }) => {
  return (
    <Image
      src="/logo.png"
      alt="LovSigil"
      width={32}
      height={32}
      className={className}
    />
  );
};

export { LovSigilIcon };
