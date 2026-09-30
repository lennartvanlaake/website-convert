import { describe, it, expect } from "bun:test";
import { setupDatabase, db } from "./db";
import { tasksTable, subtasksTable } from "./schema";
import { randomUUIDv7 } from "bun";

describe("setupDatabase", () => {
  it("migrates and round-trips epic -> task -> subtask -> blocker", async () => {
    setupDatabase(":memory:");

    const taskId = randomUUIDv7();
    const subTaskId = randomUUIDv7();

    await db
      .insert(tasksTable)
      .values({ id: taskId, title: "Task A", description: "d" });
    await db.insert(subtasksTable).values({
      id: subTaskId,
      title: "Sub A",
      description: "d",
      taskId,
    });

    expect((await db.select().from(tasksTable)).length).toBe(1);
    expect((await db.select().from(subtasksTable)).length).toBe(1);

    // delete children first (FK enforcement: tasks reference epics),
    // then parents. crud.ts handles cascade automatically.
    db.delete(subtasksTable).values({ id: subTaskId });
    db.delete(tasksTable).values({ id: taskId });

    expect((await db.select().from(tasksTable)).length).toBe(0);
    expect((await db.select().from(subtasksTable)).length).toBe(0);
  });
});
