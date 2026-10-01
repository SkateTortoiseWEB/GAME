import { notFound, redirect } from "next/navigation";
import { genreById, MAIN_GENRE_ID } from "@/lib/genres";

/** An extra question. The app itself lives in the root layout; this page only validates the URL. */
export default async function PlayPage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params;
  if (genre === MAIN_GENRE_ID) redirect("/");
  if (!genreById(genre)) notFound();
  return null;
}
