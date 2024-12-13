import MICLogo from "@/app/ui/MICLogo";
import LoginForm from "@/app/ui/login/login-form";
import VideoTY from "./ui/login/VideoTY";
// import Image from "next/image";


export default function Page() {
  return (
    <main className="flex min-h-screen flex-col p-4 md:p-6">
      <div className="flex h-20 shrink-0 items-end rounded-lg bg-mic-gradient p-4 md:h-52"></div>
      <div className="mt-6 flex grow flex-col gap-6 xl:flex-row">
        <div className="flex flex-col justify-center items-center gap-6 rounded-lg bg-light-bg-2 border border-light-boxshadow dark:border-dark-boxshadow dark:bg-dark-bg-2 px-6 py-10 xl:w-2/5 md:px-20">
          <MICLogo />
          <LoginForm />
        </div>
        <div className="xl:w-3/5 flex items-center">
          {/* Add Hero Images Here */}
          <VideoTY />
        </div>
      </div>
    </main>
  );
}
