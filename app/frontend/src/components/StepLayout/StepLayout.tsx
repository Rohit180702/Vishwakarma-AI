import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import styles from './StepLayout.module.css'

interface StepLayoutProps {
  onRestartFrom: (route: string) => void
  stepAccessible: boolean[]
  projectName?: string | null
}

export function StepLayout({ onRestartFrom, stepAccessible, projectName }: StepLayoutProps) {
  return (
    <div className={styles.page}>
      <AppHeader projectName={projectName} />
      <FlowStepper onRestartFrom={onRestartFrom} stepAccessible={stepAccessible} />
      <Outlet />
    </div>
  )
}
