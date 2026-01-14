import Image from 'next/image';

type LannaMirror3IconProps = {
  className?: string;
};

const LannaMirror3Icon: React.FC<LannaMirror3IconProps> = ({ className = 'h-8 w-8' }) => {
  return (
    <Image
      src="/logo.svg"
      alt="LannaMirror3"
      width={32}
      height={32}
      className={className}
    />
  );
};

export { LannaMirror3Icon };
