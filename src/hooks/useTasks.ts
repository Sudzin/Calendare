import { useState, useEffect, useCallback } from 'react';
import { Task } from '../types';
import { TaskRepository, UpdateTaskInput } from '../repositories/TaskRepository';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    return TaskRepository.getAll();
  });

  useEffect(() => {
    TaskRepository.saveAll(tasks);
  }, [tasks]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task => {
    const newTask = TaskRepository.create(taskData);
    setTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)]);
    return newTask;
  }, []);

  const updateTask = useCallback((updated: UpdateTaskInput): Task => {
    const updatedTask = TaskRepository.update(updated);
    setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
    return updatedTask;
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    TaskRepository.delete(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const setAllTasks = useCallback((newTasks: Task[]) => {
    TaskRepository.saveAll(newTasks);
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
