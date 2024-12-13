import { Lusitana, Poppins } from 'next/font/google';

export const lusitana = Lusitana({ 
  subsets: ['latin'], 
  weight: ['400', '700'] 
});
export const poppins = Poppins({
  subsets: ['latin'], 
  weight: ['300', '400', '700']
});