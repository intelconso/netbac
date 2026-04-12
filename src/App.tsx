import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomeScreen from './screens/HomeScreen';
import BacDetailScreen from './screens/BacDetailScreen';
import AddProductScreen from './screens/AddProductScreen';
import AlertsScreen from './screens/AlertsScreen';
import ExportScreen from './screens/ExportScreen';
import SettingsScreen from './screens/SettingsScreen';
import StorageUnitScreen from './screens/StorageUnitScreen';
import ReportsScreen from './screens/ReportsScreen';
import AllLabelsScreen from './screens/AllLabelsScreen';
import JournalScreen from './screens/JournalScreen';
import ExpressAddScreen from './screens/ExpressAddScreen';
import HistoryScreen from './screens/HistoryScreen';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomeScreen />} />
          <Route path="bac/:id" element={<BacDetailScreen />} />
          <Route path="unit/:id" element={<StorageUnitScreen />} />
          <Route path="add-product" element={<AddProductScreen />} />
          <Route path="express-add" element={<ExpressAddScreen />} />
          <Route path="alerts" element={<AlertsScreen />} />
          <Route path="reports" element={<ReportsScreen />} />
          <Route path="labels" element={<AllLabelsScreen />} />
          <Route path="journal" element={<JournalScreen />} />
          <Route path="history" element={<HistoryScreen />} />
          <Route path="export" element={<ExportScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
