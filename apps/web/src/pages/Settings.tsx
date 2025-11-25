import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

interface ProfileForm {
  name: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function Settings() {
  const { user, updateProfile } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
  } = useForm<ProfileForm>({
    defaultValues: {
      name: user?.name || '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    watch,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordForm>();

  const newPassword = watch('newPassword');

  const onProfileSubmit = async (data: ProfileForm) => {
    try {
      setIsUpdatingProfile(true);
      await updateProfile({ name: data.name });
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    try {
      setIsUpdatingPassword(true);
      await updateProfile({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password updated successfully!');
      resetPassword();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Manage your account settings
        </p>
      </motion.div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card mb-6"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Profile</h2>
        </div>
        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="p-6 space-y-5">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
            />
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Email cannot be changed
            </p>
          </div>
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              className="input"
              placeholder="Your name"
              {...registerProfile('name')}
            />
          </div>
          <button type="submit" disabled={isUpdatingProfile} className="btn-primary">
            {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </motion.div>

      {/* Password Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card mb-6"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="p-6 space-y-5">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...registerPassword('currentPassword', {
                required: 'Current password is required',
              })}
            />
            {passwordErrors.currentPassword && (
              <p className="mt-1.5 text-sm text-red-500">
                {passwordErrors.currentPassword.message}
              </p>
            )}
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...registerPassword('newPassword', {
                required: 'New password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
              })}
            />
            {passwordErrors.newPassword && (
              <p className="mt-1.5 text-sm text-red-500">{passwordErrors.newPassword.message}</p>
            )}
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...registerPassword('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) => value === newPassword || 'Passwords do not match',
              })}
            />
            {passwordErrors.confirmPassword && (
              <p className="mt-1.5 text-sm text-red-500">
                {passwordErrors.confirmPassword.message}
              </p>
            )}
          </div>
          <button type="submit" disabled={isUpdatingPassword} className="btn-primary">
            {isUpdatingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </motion.div>

      {/* Appearance Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Appearance</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Theme</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Switch between light and dark mode
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isDark ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white transition-transform ${
                  isDark ? 'translate-x-7' : 'translate-x-1'
                }`}
              >
                {isDark ? '🌙' : '☀️'}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

