import { notFound } from "next/navigation";
import { genreById } from "@/lib/genres";
import Game from "../../Game";

export default async function PlayPage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params;
  if (!genreById(genre)) notFound();
  return <Game genre={genre} />;
}
