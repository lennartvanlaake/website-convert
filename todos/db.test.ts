import { setupDatabase } from "./db";
import { epicsTable, tasksTable, subtasksTable, blockersTable } from "./schema";

describe("setupDatabase", () => {
  it("migrates and round-trips epic -> task -> subtask -> blocker", async () => {
    const db = setupDatabase(":memory:");

    await db
      .insert(epicsTable)
      .values({ title: "Epic A", description: "desc" });
    await db
      .insert(tasksTable)
      .values({ title: "Task A", description: "d", epicId: 1 });
    await db
      .insert(subtasksTable)
      .values({ title: "Sub A", description: "d", taskId: 1 });
    await db
      .insert(blockersTable)
      .values({ title: "Block A", description: "d", taskId: 1 });

    expect((await db.select().from(epicsTable)).length).toBe(1);
    expect((await db.select().from(tasksTable)).length).toBe(1);
    expect((await db.select().from(subtasksTable)).length).toBe(1);
    expect((await db.select().from(blockersTable)).length).toBe(1);

    // delete children first (FK enforcement: tasks reference epics),
    // then parents. crud.ts handles cascade automatically.
    await db.delete(subtasksTable).values({ id: 1 });
    await db.delete(blockersTable).values({ id: 1 });
    await db.delete(tasksTable).values({ id: 1 });

    expect((await db.select().from(epicsTable)).length).toBe(1);
    expect((await db.select().from(tasksTable)).length).toBe(0);
    expect((await db.select().from(subtasksTable)).length).toBe(0);
    expect((await db.select().from(blockersTable)).length).toBe(0);
  });
});
