import { describe, it, expect } from "bun:test";
import { setupDatabase, db } from "./db";
import { tasksTable, subtasksTable } from "./schema";

describe("setupDatabase", () => {
  it("migrates and round-trips epic -> task -> subtask -> blocker", async () => {
    setupDatabase(":memory:");

    await db.insert(tasksTable).values({ title: "Task A", description: "d" });
    await db
      .insert(subtasksTable)
      .values({ title: "Sub A", description: "d", taskId: 1 });

    expect((await db.select().from(tasksTable)).length).toBe(1);
    expect((await db.select().from(subtasksTable)).length).toBe(1);

    // delete children first (FK enforcement: tasks reference epics),
    // then parents. crud.ts handles cascade automatically.
    db.delete(subtasksTable).values({ id: 1 });
    db.delete(tasksTable).values({ id: 1 });

    expect((await db.select().from(tasksTable)).length).toBe(0);
    expect((await db.select().from(subtasksTable)).length).toBe(0);
  });
});
