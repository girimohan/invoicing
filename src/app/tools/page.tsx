import YELCalculator from '@/components/YELCalculator'

export const dynamic = 'force-dynamic'

export default function ToolsPage() {
  return (
    <div className="flex-1 bg-gray-50 min-h-screen p-8">
      <YELCalculator />
    </div>
  )
}
