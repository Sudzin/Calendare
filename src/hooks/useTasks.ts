import { useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '../types';
import { TaskRepository, UpdateTaskInput } from '../repositories/TaskRepository';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    return TaskRepository.getAll();
  });
  const isFirstRender = useRef(true);

  // Единственный писатель в localStorage — useEffect по tasks (пропускает первичный рендер при монтировании)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    TaskRepository.saveAll(tasks);
  }, [tasks]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task => {
    const newTask = TaskRepository.create(taskData);
    setTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)]);
    return newTask;
  }, []);

  const updateTask = useCallback((updated: UpdateTaskInput): Task => {
    const existing = tasks.find(t => t.id === updated.id);
    const updatedTask = TaskRepository.update(updated, existing);
    setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
    return updatedTask;
  }, [tasks]);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => TaskRepository.delete(taskId, prev));
  }, []);

  const setAllTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
  }, []);

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    setAllTasks,
  };
}
