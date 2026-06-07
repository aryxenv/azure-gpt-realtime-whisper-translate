export interface SlideProps {
  isActive: boolean;
  cycleIndex: number;
  cycleCount: number;
  onSelectCycle: (index: number) => void;
}
