import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import DashHome from './pages/dashboard/DashHome.jsx';
import Discussions from './pages/dashboard/Discussions.jsx';
import Contacts from './pages/dashboard/Contacts.jsx';
import Utilisateurs from './pages/dashboard/Utilisateurs.jsx';
import Parametres from './pages/dashboard/Parametres.jsx';
import RolesPermissions from './pages/dashboard/RolesPermissions.jsx';

function PublicLayout() {
  return (
    <>
      <Navbar />
      <main><Outlet /></main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Pages publiques */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
      </Route>
      <Route path="/connexion" element={<Login />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashHome />} />
        <Route path="discussions"   element={<Discussions />} />
        <Route path="contacts"      element={<Contacts />} />
        <Route path="utilisateurs"  element={<Utilisateurs />} />
        <Route path="utilisateurs/roles" element={<RolesPermissions />} />
        <Route path="parametres"    element={<Parametres />} />
      </Route>
    </Routes>
  );
}
