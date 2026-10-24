package pt.mygym;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import pt.mygym.WorkoutApi.Kind;
import pt.mygym.WorkoutApi.SetEntry;

class ProgressionAdvisorTest {
    private SetEntry set(Kind kind, String weight, int reps, String rpe) {
        return new SetEntry(1, 1, kind, new BigDecimal(weight), reps,
            rpe == null ? null : new BigDecimal(rpe), Instant.now());
    }

    @Test
    void suggestsAnIncreaseAfterReachingTheTargetWithManageableEffort() {
        var result = ProgressionAdvisor.recommend(List.of(
            set(Kind.WARMUP, "5", 10, null), set(Kind.WORK, "10", 10, "8.0")), 10);
        assertThat(result.workWeightKg()).isEqualByComparingTo("12.0");
        assertThat(result.warmupWeightKg()).isEqualByComparingTo("5.0");
    }

    @Test
    void keepsWeightWhenRepsAreShortOrEffortIsHigh() {
        var result = ProgressionAdvisor.recommend(List.of(set(Kind.WORK, "20", 8, "9.0")), 10);
        assertThat(result.workWeightKg()).isEqualByComparingTo("20");
        assertThat(result.warmupWeightKg()).isEqualByComparingTo("10");
    }

    @Test
    void doesNotTreatWarmupAsPreviousWorkingWeight() {
        var result = ProgressionAdvisor.recommend(List.of(set(Kind.WARMUP, "8", 10, null)), 10);
        assertThat(result.workWeightKg()).isNull();
    }
}
