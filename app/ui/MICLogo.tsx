import Image from "next/image";

export default function MICLogo() {
  return (
    <div className={`flex flex-col gap-2 mb-4 items-center leading-none text-light-title dark:text-dark-title`}>
      <div className="w-28">
        <Image
          src="/images/logos/icon_mic.png"
          width={297}
          height={266}
          alt="Icon made in casa"
        />
      </div>
      <p className="text-3xl font-light">
        MADE IN <span className="font-bold">CASA</span>
      </p>
    </div>
  );
}
