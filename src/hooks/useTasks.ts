import { useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '../types';
import { TaskRepository, UpdateTaskInput } from '../repositories/TaskRepository';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    return TaskRepository.getAll();
  });
  const isFirstRender = useRef(true);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

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

  // Слежение за внешними изменениями (изменения файлов другим ПК или другой вкладкой)
  useEffect(() => {
    const unregister = TaskRepository.onExternalChange(() => {
      TaskRepository.loadAsync().then(loaded => {
        const currentTasks = tasksRef.current;
        const currentSerialized = JSON.stringify(currentTasks);
        const loadedSerialized = JSON.stringify(loaded);

        // Обновляем состояние ТОЛЬКО если есть реальные изменения, исключая циклический цикл
        if (currentSerialized !== loadedSerialized) {
          setTasks(loaded);
        }
      }).catch(err => {
        console.error('Failed to reload tasks after external change:', err);
      });
    });

    return () => {
      unregister();
    };
  }, []);

  // Синхронизация списка в localStorage ТОЛЬКО для localStorage-бэкенда
  // Для Tauri-бэкенда эффект saveAll НЕ вызывается: пишутся только измененные задачи
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (TaskRepository.getBackend().type === 'localStorage') {
      TaskRepository.saveAll(tasks);
    }
  }, [tasks]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task => {
    const newTask = TaskRepository.create(taskData);
    setTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)]);
    TaskRepository.saveTask(newTask).catch(err => console.error('Failed to save task file:', err));
    return newTask;
  }, []);

  const updateTask = useCallback((updated: UpdateTaskInput): Task => {
    const existing = tasksRef.current.find(t => t.id === updated.id);
    const updatedTask = TaskRepository.update(updated, existing);
    setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
    TaskRepository.saveTask(updatedTask).catch(err => console.error('Failed to update task file:', err));
    return updatedTask;
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => TaskRepository.delete(taskId, prev));
    TaskRepository.deleteTask(taskId).catch(err => console.error('Failed to delete task file:', err));
  }, []);

  const setAllTasks = useCallback((newTasks: Task[]) => {
    if (TaskRepository.getBackend().type === 'file') {
      const oldMap = new Map(tasks.map(t => [t.id, t]));
      const newMap = new Map(newTasks.map(t => [t.id, t]));

      // 1. Изменённые и новые пиши
      for (const newTask of newTasks) {
        const oldTask = oldMap.get(newTask.id);
        if (!oldTask || JSON.stringify(oldTask) !== JSON.stringify(newTask)) {
          TaskRepository.saveTask(newTask).catch(err => console.error('Failed to save task file:', err));
        }
      }

      // 2. Отсутствующие в новом наборе ставь tombstone
      for (const oldTask of tasks) {
        if (!newMap.has(oldTask.id)) {
          TaskRepository.deleteTask(oldTask.id).catch(err => console.error('Failed to tombstone task file:', err));
        }
      }
    } else {
      TaskRepository.saveAll(newTasks);
    }

    setTasks(newTasks);
  }, [tasks]);

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    setAllTasks,
  };
}
