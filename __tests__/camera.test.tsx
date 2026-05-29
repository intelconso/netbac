import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import CameraScreen from '../app/camera';

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
  });

  it('renders permission-granted state with shutter button', async () => {
    const { getByTestId } = render(<CameraScreen />);
    expect(getByTestId('cam-shutter')).toBeTruthy();
    expect(getByTestId('camera-view')).toBeTruthy();
  });

  it('capture → save flow navigates back', async () => {
    const { getByTestId } = render(<CameraScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('cam-shutter'));
    });
    await waitFor(() => getByTestId('cam-save'));
    fireEvent.press(getByTestId('cam-save'));
    expect(mockBack).toHaveBeenCalled();
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
