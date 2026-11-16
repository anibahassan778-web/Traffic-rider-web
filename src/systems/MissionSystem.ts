import { CareerMission } from './GameConfig';
import { ScoringState } from './ScoringSystem';

export const CAREER_MISSIONS: CareerMission[] = [
  {
    id: 1,
    title: 'Highway Warmup',
    type: 'distance',
    description: 'Ride 900 m through light morning highway traffic.',
    targetValue: 900,
    timeLimitSec: 45,
    rewardMoney: 650,
    trafficDensity: 0.7,
    trafficMode: 'oneway',
    theme: 'day',
  },
  {
    id: 2,
    title: 'Lane Splitter',
    type: 'overtake',
    description: 'Overtake 10 traffic vehicles before time runs out.',
    targetValue: 10,
    timeLimitSec: 50,
    rewardMoney: 950,
    trafficDensity: 0.9,
    trafficMode: 'oneway',
    theme: 'day',
  },
  {
    id: 3,
    title: 'Sunset Apex',
    type: 'time_trial',
    description: 'Cover 1,500 m within 36 seconds at golden hour.',
    targetValue: 1500,
    timeLimitSec: 36,
    rewardMoney: 1300,
    trafficDensity: 0.85,
    trafficMode: 'oneway',
    theme: 'sunset',
  },
  {
    id: 4,
    title: 'Redline Cruise',
    type: 'speed_endurance',
    description: 'Hold above 150 km/h for 12 cumulative seconds.',
    targetValue: 12,
    timeLimitSec: 45,
    minSpeedKmh: 150,
    rewardMoney: 1650,
    trafficDensity: 0.95,
    trafficMode: 'oneway',
    theme: 'sunset',
  },
  {
    id: 5,
    title: 'Wrong-Way Slalom',
    type: 'overtake',
    description: 'Thread past 18 cars in Two-Way rush hour traffic.',
    targetValue: 18,
    timeLimitSec: 55,
    rewardMoney: 2100,
    trafficDensity: 1.15,
    trafficMode: 'twoway',
    theme: 'sunset',
  },
  {
    id: 6,
    title: 'Midnight Express',
    type: 'distance',
    description: 'Push 2,400 m down the neon night highway in 50s.',
    targetValue: 2400,
    timeLimitSec: 50,
    rewardMoney: 2600,
    trafficDensity: 1.15,
    trafficMode: 'oneway',
    theme: 'night',
  },
  {
    id: 7,
    title: 'Superbike Fury',
    type: 'speed_endurance',
    description: 'Maintain 200+ km/h for 15 cumulative seconds at night.',
    targetValue: 15,
    timeLimitSec: 50,
    minSpeedKmh: 200,
    rewardMoney: 3200,
    trafficDensity: 1.15,
    trafficMode: 'oneway',
    theme: 'night',
  },
  {
    id: 8,
    title: 'Traffic Phantom',
    type: 'overtake',
    description: 'Dodge oncoming & same-way cars for 26 passes at night.',
    targetValue: 26,
    timeLimitSec: 60,
    rewardMoney: 4200,
    trafficDensity: 1.3,
    trafficMode: 'twoway',
    theme: 'night',
  },
];

export interface MissionProgressStatus {
  current: number;
  target: number;
  ratio: number;
  label: string;
  completed: boolean;
  failed: boolean;
  failReason: string;
}

export function evaluateMissionProgress(
  mission: CareerMission,
  scoring: ScoringState,
  highSpeedHeldSec: number,
  elapsedSec: number
): MissionProgressStatus {
  let current = 0;
  let unit = '';

  switch (mission.type) {
    case 'distance':
    case 'time_trial':
      current = Math.floor(scoring.distanceM);
      unit = 'm';
      break;
    case 'overtake':
      current = scoring.overtakes;
      unit = 'cars';
      break;
    case 'speed_endurance':
      current = Number(highSpeedHeldSec.toFixed(1));
      unit = 's';
      break;
  }

  const ratio = Math.min(1, current / Math.max(1, mission.targetValue));
  const completed = current >= mission.targetValue;
  const timedOut = !completed && mission.timeLimitSec > 0 && elapsedSec >= mission.timeLimitSec;

  const currentDisplay =
    mission.type === 'speed_endurance' ? `${current.toFixed(1)}` : `${Math.round(current)}`;

  return {
    current,
    target: mission.targetValue,
    ratio,
    label: `${currentDisplay} / ${mission.targetValue} ${unit}`,
    completed,
    failed: timedOut,
    failReason: timedOut ? 'Time Expired' : '',
  };
}
