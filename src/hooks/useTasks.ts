import { useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '../types';
import { TaskRepository, UpdateTaskInput } from '../repositories/TaskRepository';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    return TaskRepository.getAll();
  });
  const isFirstRender = useRef(true);

  // Первичная синхронизация из асинхронного хранилища (Tauri) при монтировании
  useEffect(() => {
    let isMounted = true;
    TaskRepository.loadAsync().then(loaded => {
      if (isMounted && loaded.length > 0) {
        setTasks(loaded);
      }
    }).catch(err => {
      console.error('Failed to load tasks from storage:', err);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Синхронизация списка в активное хранилище (пропускает первичный рендер)
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
    TaskRepository.saveTask(newTask).catch(err => console.error('Failed to save task file:', err));
    return newTask;
  }, []);

  const updateTask = useCallback((updated: UpdateTaskInput): Task => {
    const existing = tasks.find(t => t.id === updated.id);
    const updatedTask = TaskRepository.update(updated, existing);
    setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
    TaskRepository.saveTask(updatedTask).catch(err => console.error('Failed to update task file:', err));
    return updatedTask;
  }, [tasks]);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => TaskRepository.delete(taskId, prev));
    TaskRepository.deleteTask(taskId).catch(err => console.error('Failed to delete task file:', err));
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
