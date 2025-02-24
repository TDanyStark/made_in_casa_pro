'use server'

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '../queries/clients';
import { redirect } from 'next/navigation';

const ClientSchema = z.object({
  id: z.number(),
  name: z.string(),
  country_id: z.number(),
});

const CreateClient = ClientSchema.omit({ id: true });


export async function createClientAction(formData: FormData){
  const {name, country_id} = CreateClient.parse({
    name: formData.get('name') as string,
    country_id: Number(formData.get('country_id')) as number,
  });

  try{
    await createClient(name, country_id);
    revalidatePath('/clients');
    redirect('/clients');
  } catch (error) {
    console.error('Error al crear cliente:', error);
    throw new Error('No se pudo crear el cliente');
  }
}