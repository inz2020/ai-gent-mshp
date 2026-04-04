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
import Diffusions from './pages/dashboard/Diffusions.jsx';
import Regions from './pages/dashboard/Regions.jsx';
import Districts from './pages/dashboard/Districts.jsx';
import Structures from './pages/dashboard/Structures.jsx';
import Vaccins from './pages/dashboard/Vaccins.jsx';
import CalendrierVaccinal from './pages/dashboard/CalendrierVaccinal.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import NotFound from './pages/NotFound.jsx';
import ErrorPage from './pages/ErrorPage.jsx';

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

      {/* Dashboard — protégé */}
      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashHome />} />
          <Route path="discussions"        element={<Discussions />} />
          <Route path="contacts"           element={<Contacts />} />
          <Route path="utilisateurs"       element={<Utilisateurs />} />
          <Route path="utilisateurs/roles" element={<RolesPermissions />} />
          <Route path="diffusions"                    element={<Diffusions />} />
          <Route path="metadonnees/regions"          element={<Regions />} />
          <Route path="metadonnees/districts"        element={<Districts />} />
          <Route path="metadonnees/structures"       element={<Structures />} />
          <Route path="metadonnees/vaccins"          element={<Vaccins />} />
          <Route path="metadonnees/calendrier"       element={<CalendrierVaccinal />} />
          <Route path="parametres"                   element={<Parametres />} />
        </Route>
      </Route>
      {/* Pages d'erreur */}
      <Route path="/erreur" element={<ErrorPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
