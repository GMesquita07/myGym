package pt.mygym;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import pt.mygym.WorkoutApi.Kind;
import pt.mygym.WorkoutApi.Recommendation;
import pt.mygym.WorkoutApi.SetEntry;

final class ProgressionAdvisor {
    private ProgressionAdvisor() {}

    static Recommendation recommend(List<SetEntry> previous, int targetReps) {
        List<SetEntry> work = previous.stream().filter(s -> s.kind() == Kind.WORK).toList();
        if (work.isEmpty()) return new Recommendation(null, null, "Primeira sessão: escolhe um peso confortável e ajusta pela técnica.");
        BigDecimal top = work.stream().map(SetEntry::weightKg).max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
        boolean ready = work.stream().filter(s -> s.weightKg().compareTo(top) == 0)
            .anyMatch(s -> s.reps() >= targetReps && (s.rpe() == null || s.rpe().compareTo(new BigDecimal("8.5")) <= 0));
        BigDecimal next = ready ? top.add(new BigDecimal("2.0")) : top;
        BigDecimal warmup = next.multiply(new BigDecimal("0.5")).divide(new BigDecimal("2.5"), 0, RoundingMode.HALF_UP).multiply(new BigDecimal("2.5"));
        return new Recommendation(next, warmup,
            ready ? "Atingiste as repetições no último treino. Podes experimentar mais 2 kg, se a técnica estiver boa."
                  : "Mantém o peso e procura completar as repetições com boa técnica.");
    }
}
