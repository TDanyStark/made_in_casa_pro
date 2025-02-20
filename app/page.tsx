import { Metadata } from "next"
import { ModeToggle } from "./components/ModeToggle"
import { UserLoginForm } from "./components/login/UserLoginForm";
import MICLogo from "./components/icons/MICLogo";

export const metadata: Metadata = {
  title: "Login",
}

export default function Home() {
  return (
    <>
      <div className="container relative h-[800px] flex-col items-center justify-center md:grid lg:max-w-none lg:h-screen lg:grid-cols-2 lg:px-0">
        <div className="absolute right-4 top-4 md:right-8 md:top-8">
          <ModeToggle />
        </div>
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-gradient-to-r from-market-pink to-market-purple" />
          <div className="relative z-20 flex items-center">
            <div className="max-w-60">
              <MICLogo/>
            </div>
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;Si el plan A no funciona, recuerda que el abecedario tiene 26 letras más (¡y en Excel muchas más!).&rdquo;
              </p>
              <footer className="text-sm">Sandy Baron</footer>
            </blockquote>
          </div>
        </div>
        <div className="p-8 min-h-screen flex items-center justify-center">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight mb-6">
                Login
              </h1>
              <UserLoginForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


