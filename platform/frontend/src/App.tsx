import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import PatientDashboard from './pages/patient/Dashboard'
import PatientRecords from './pages/patient/Records'
import PatientNotes from './pages/patient/Notes'
import PatientRequests from './pages/patient/Requests'
import PatientLogs from './pages/patient/Logs'
import PatientAccessLog from './pages/patient/AccessLog'
import PatientPreferences from './pages/patient/Preferences'
import PatientFulfillment from './pages/patient/Fulfillment'
import PatientFeedback from './pages/patient/Feedback'
import EhrDashboard from './pages/ehr/Dashboard'
import EhrRecords from './pages/ehr/RetrievedRecords'
import ClinicianView from './pages/ehr/ClinicianView'
import RelationalRecords from './pages/ehr/RelationalRecords'
import Clinicians from './pages/ehr/Clinicians'
import Cds from './pages/ehr/Cds'
import FeedbackInbox from './pages/ehr/FeedbackInbox'
import OrderComposer from './pages/ehr/OrderComposer'
import WorkQueue from './pages/ehr/WorkQueue'
import OrderStatus from './pages/ehr/OrderStatus'
import EhrConnections from './pages/ehr/Connections'
import PatientOrderReview from './pages/patient/OrderReview'
import Landing from './pages/Landing'
import CareOSLanding from './pages/CareOSLanding'
import ResearchLanding from './pages/research/ResearchLanding'
import ParticipantStudy from './pages/research/ParticipantStudy'
import ResearcherDashboard from './pages/research/ResearcherDashboard'
import ThemeExplorer from './pages/research/ThemeExplorer'
import RelationalShowcase from './pages/research/RelationalShowcase'
import PatientLogin from './pages/login/PatientLogin'
import ClinicianLogin from './pages/login/ClinicianLogin'
import OrderFlowPage from './pages/OrderFlowPage'
import RelationalCdsPage from './pages/RelationalCdsPage'
import FhirStandardsExplorer from './pages/FhirStandardsExplorer'
import Web3DataEconomy from './pages/Web3DataEconomy'
import PatientCheckin from './pages/checkin/PatientCheckin'
import ClinicScanner from './pages/checkin/ClinicScanner'
import PatientQR from './pages/checkin/PatientQR'
import LiveDashboard from './pages/LiveDashboard'
import WaitingRoomBoard from './pages/clinic/WaitingRoomBoard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CareOSLanding />} />
      <Route path="/launchflow" element={<Landing />} />
      <Route path="/research" element={<ResearchLanding />} />
      <Route path="/research/study" element={<ParticipantStudy />} />
      <Route path="/research/dashboard" element={<ResearcherDashboard />} />
      <Route path="/research/themes" element={<ThemeExplorer />} />
      <Route path="/relational" element={<RelationalShowcase />} />
      <Route path="/login/patient" element={<PatientLogin />} />
      <Route path="/login/clinician" element={<ClinicianLogin />} />
      <Route path="/order-flow" element={<OrderFlowPage />} />
      <Route path="/relational-cds" element={<RelationalCdsPage />} />
      <Route path="/fhir-standards" element={<FhirStandardsExplorer />} />
      <Route path="/web3" element={<Web3DataEconomy />} />
      <Route path="/live" element={<LiveDashboard />} />
      <Route path="/checkin/:token" element={<PatientCheckin />} />
      <Route path="/clinic/scan" element={<ClinicScanner />} />
      <Route path="/clinic/board" element={<WaitingRoomBoard />} />
      <Route path="/patient/qr/:patientId" element={<PatientQR />} />
      <Route path="/patient" element={<Layout mode="patient" />}>
        <Route index element={<PatientDashboard />} />
        <Route path="records" element={<PatientRecords />} />
        <Route path="notes" element={<PatientNotes />} />
        <Route path="requests" element={<PatientRequests />} />
        <Route path="logs" element={<PatientLogs />} />
        <Route path="access-log" element={<PatientAccessLog />} />
        <Route path="preferences" element={<PatientPreferences />} />
        <Route path="fulfillment" element={<PatientFulfillment />} />
        <Route path="feedback" element={<PatientFeedback />} />
        <Route path="orders" element={<PatientOrderReview />} />
      </Route>
      <Route path="/ehr" element={<Layout mode="ehr" />}>
        <Route index element={<EhrDashboard />} />
        <Route path="records" element={<EhrRecords />} />
        <Route path="chart" element={<RelationalRecords />} />
        <Route path="clinician" element={<ClinicianView />} />
        <Route path="clinicians" element={<Clinicians />} />
        <Route path="compose" element={<OrderComposer />} />
        <Route path="queue" element={<WorkQueue />} />
        <Route path="order-status" element={<OrderStatus />} />
        <Route path="cds" element={<Cds />} />
        <Route path="feedback" element={<FeedbackInbox />} />
        <Route path="connections" element={<EhrConnections />} />
      </Route>
    </Routes>
  )
}
