type ProgressBarProps = { currentStep: number; totalSteps: number; };
const ProgressBar = ({ currentStep, totalSteps }: ProgressBarProps) => {
  return (
    <div className="flex-1 h-2 bg-[#333333] dark:bg-[#282828] rounded overflow-hidden">
      <div
        className="h-full bg-[#DB9A98]"
        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
      ></div>
    </div>
  );
}
export default ProgressBar;