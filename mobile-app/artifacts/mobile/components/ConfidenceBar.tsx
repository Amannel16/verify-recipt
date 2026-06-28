import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { VerificationStatus } from "@/contexts/VerificationContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  confidence: number;
  status: VerificationStatus;
  showLabel?: boolean;
}

export function ConfidenceBar({ confidence, status, showLabel = true }: Props) {
  const colors = useColors();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(200, withTiming(confidence, { duration: 1000 }));
  }, [confidence]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${width.value}%` as unknown as number,
  }));

  const barColor =
    status === "approved" ? colors.success
    : status === "suspicious" ? colors.warning
    : colors.destructive;

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Confidence</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{confidence}%</Text>
        </View>
      )}
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.fill, animStyle, { backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 13, fontFamily: "Inter_400Regular" },
  value: { fontSize: 14, fontFamily: "Inter_700Bold" },
  track: { height: 8, borderRadius: 100, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 100 },
});
