import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserList } from './components/UserList';
import { CreateUserForm } from './components/CreateUserForm';
import './App.css';

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

interface AppState {
  users: User[];
  loading: boolean;
  error: string | null;
}

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    users: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await axios.get('/api/users');
      setState(prev => ({ ...prev, users: response.data, loading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to fetch users' 
      }));
    }
  };

  const createUser = async (userData: Omit<User, 'id' | 'createdAt'>) => {
    try {
      const response = await axios.post('/api/users', userData);
      setState(prev => ({ 
        ...prev, 
        users: [...prev.users, response.data] 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to create user' 
      }));
    }
  };

  const deleteUser = async (userId: number) => {
    try {
      await axios.delete(`/api/users/${userId}`);
      setState(prev => ({ 
        ...prev, 
        users: prev.users.filter(user => user.id !== userId) 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to delete user' 
      }));
    }
  };

  if (state.loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>User Management System</h1>
      </header>
      
      <main className="app-main">
        {state.error && (
          <div className="error-message">
            {state.error}
            <button onClick={fetchUsers}>Retry</button>
          </div>
        )}
        
        <section className="create-user-section">
          <h2>Create New User</h2>
          <CreateUserForm onSubmit={createUser} />
        </section>
        
        <section className="users-section">
          <h2>Users ({state.users.length})</h2>
          <UserList 
            users={state.users} 
            onDelete={deleteUser}
            onRefresh={fetchUsers}
          />
        </section>
      </main>
    </div>
  );
};