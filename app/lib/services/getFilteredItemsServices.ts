import { getFilteredItems } from "../queries/sharedQueries";

export async function getFilteredItemsServices<T>(table: string, query: string, currentPage: number){
  try {
    const response = await getFilteredItems<T>(table, query, currentPage);
    return response;
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw new Error('No se pudieron obtener los clientes');
  }
}