'use server'

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ClientSchema = z.object({
  id: z.number(),
  name: z.string(),
  country_id: z.number(),
});

const CreateClient = ClientSchema.omit({ id: true });

export async function createClient(formData: FormData): Promise<void>{
  const {name, country_id} = CreateClient.parse({
    name: formData.get('name') as string,
    country_id: Number(formData.get('country_id')) as number,
  });
  console.log(name, country_id);

  // revalidar el path
  revalidatePath('/clients');
}

const CountrySchema = z.object({
  id: z.string(),
  name: z.string(),
  flag: z.string(),
});

const CreateCountry = CountrySchema.omit({ id: true });

export async function createCountry(formData: FormData): Promise<void> {
  const {name, flag} = CreateCountry.parse({
    name: formData.get('name') as string,
    flag: formData.get('flag') as string,
  });
  console.log(name, flag);
}