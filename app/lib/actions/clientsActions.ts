'use server'

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, fetchFilteredClients } from '../queries/clients';
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
  } catch (error) {
    console.error('Error al crear cliente:', error);
    throw new Error('No se pudo crear el cliente');
  }

  revalidatePath('/clients');
  redirect('/clients');
}

export async function fetchFilteredClientsAction(query: string, currentPage: number){
  try {
    const response = await fetchFilteredClients(query, currentPage);
    return response;
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw new Error('No se pudieron obtener los clientes');
  }
}