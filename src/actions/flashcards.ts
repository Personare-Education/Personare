import { ipc } from "@/ipc/manager";

export interface FlashcardContentValues {
  back: string;
  backImagePath: string | null;
  front: string;
  frontImagePath: string | null;
}

export function listFlashcards(activityId: string) {
  return ipc.client.flashcards.list({ activityId });
}

export function createFlashcard(
  activityId: string,
  values: FlashcardContentValues
) {
  return ipc.client.flashcards.create({ activityId, ...values });
}

export function updateFlashcard(id: string, values: FlashcardContentValues) {
  return ipc.client.flashcards.update({ id, ...values });
}

/** Undoes the soft delete (docs/specs/safety-net.md). */
export function restoreFlashcard(id: string) {
  return ipc.client.flashcards.restore({ id });
}

export function softDeleteFlashcard(id: string) {
  return ipc.client.flashcards.softDelete({ id });
}
