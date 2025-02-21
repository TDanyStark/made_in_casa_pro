import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="min-h-screen flex items-center justify-center">
    <div className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
        <div className="mx-auto max-w-screen-sm text-center">
            <h1 className="mb-4 text-7xl tracking-tight font-extrabold lg:text-9xl text-market-pink">404</h1>
            <p className="mb-4 text-3xl tracking-tight font-bold text-gray-900 md:text-4xl dark:text-white">Algo ha fallado.</p>
            <p className="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">Lo sentimos, no hemos encontrado la ruta a la que esta intentando acceder</p>
            <Link href="/" className="btn-primary">Back to Homepage</Link>
        </div>   
    </div>
</section>
  )
}