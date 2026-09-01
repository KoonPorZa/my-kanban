import type { IKanbanTask } from 'src/types/kanban';

type SaveTask = (task: IKanbanTask) => Promise<IKanbanTask>;

type Waiter = {
  resolve: (task: IKanbanTask) => void;
  reject: (error: unknown) => void;
};

export class TaskSaveQueue {
  private current: IKanbanTask;
  private pending: Partial<IKanbanTask> = {};
  private waiters: Waiter[] = [];
  private running = false;

  constructor(
    initialTask: IKanbanTask,
    private readonly save: SaveTask,
    private readonly onSaved: (task: IKanbanTask) => void
  ) {
    this.current = initialTask;
  }

  sync(task: IKanbanTask) {
    if (task.id !== this.current.id || task.version >= this.current.version) {
      this.current = task;
    }
  }

  enqueue(changes: Partial<IKanbanTask>) {
    this.pending = { ...this.pending, ...changes };
    const promise = new Promise<IKanbanTask>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
    void this.drain();
    return promise;
  }

  private async drain() {
    if (this.running) return;
    this.running = true;

    while (Object.keys(this.pending).length > 0) {
      const changes = this.pending;
      const waiters = this.waiters;
      this.pending = {};
      this.waiters = [];

      try {
        this.current = await this.save({ ...this.current, ...changes });
        this.onSaved(this.current);
        waiters.forEach(({ resolve }) => resolve(this.current));
      } catch (error) {
        waiters.forEach(({ reject }) => reject(error));
        this.waiters.forEach(({ reject }) => reject(error));
        this.pending = {};
        this.waiters = [];
        break;
      }
    }

    this.running = false;
  }
}
