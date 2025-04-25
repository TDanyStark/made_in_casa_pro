
type Props = {
  params: Promise<{ id: string }>;
};

export default async function page({ params }: Props){
  const { id } = await params;
}