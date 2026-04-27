import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import CameraScreen from '../app/camera';
import { useStore } from '../src/lib/store';

const mockBack = jest.fn();

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
    useLocalSearchParams: () => ({ unitId: 'u1' }),
  };
});

describe('Camera screen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    useStore.setState({ logs: [] });
  });

  it('renders permission-granted state with shutter button', async () => {
    const { getByTestId } = render(<CameraScreen />);
    expect(getByTestId('cam-shutter')).toBeTruthy();
    expect(getByTestId('camera-view')).toBeTruthy();
  });

  it('capture → save flow adds an activity log and navigates back', async () => {
    const { getByTestId } = render(<CameraScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('cam-shutter'));
    });
    await waitFor(() => getByTestId('cam-save'));
    fireEvent.press(getByTestId('cam-save'));
    expect(mockBack).toHaveBeenCalled();
    const logs = useStore.getState().logs;
    expect(logs[0].details).toMatch(/Photo capturée pour Frigo 1/);
    expect(logs[0].entityId).toBe('u1');
  });

  it('retake resets captured state', async () => {
    const { getByTestId, queryByTestId } = render(<CameraScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('cam-shutter'));
    });
    await waitFor(() => getByTestId('cam-retake'));
    fireEvent.press(getByTestId('cam-retake'));
    expect(queryByTestId('cam-save')).toBeNull();
    expect(getByTestId('cam-shutter')).toBeTruthy();
  });
});
