// Order bills — the printable side of an order.
//
// The panel owns its own fetching and filtering because it reads generated
// documents rather than orders: a bill's bytes live behind the store API, so
// this page is a thin shell that gives the panel a title and a route of its
// own. Keeping it a route (instead of a dashboard tab) means a bill can be
// linked to directly and survives a reload.

import { PageTitle } from '../ui'
import { useLanguage } from '../context/LanguageContext'
import BillsPanel from '../components/BillsPanel'

export default function BillsPage() {
  const { t } = useLanguage()
  return (
    <div className="pa-bills">
      <PageTitle title={t('billsTitle')} subtitle={t('billsSubtitle')} />
      <BillsPanel />
    </div>
  )
}