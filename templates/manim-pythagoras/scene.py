from manim import *

BG = "#070b12"
CYAN = "#22d3ee"
VIOLET = "#8b5cf6"
AMBER = "#f59e0b"
MUTED = "#8fa3ba"


class PythagorasScene(Scene):
    def construct(self):
        self.camera.background_color = BG

        title = Text("Teorema de Pitágoras", font_size=42, color=WHITE)
        title.to_edge(UP, buff=0.55)
        self.play(Write(title), run_time=1.0)

        plane = NumberPlane(
            x_range=[-7, 7, 1],
            y_range=[-4, 4, 1],
            background_line_style={"stroke_color": "#142033", "stroke_width": 1},
            axis_config={"stroke_color": "#142033"},
        ).set_opacity(0.35)
        self.add(plane)

        A = np.array([-3.0, -1.4, 0])
        B = np.array([1.2, -1.4, 0])
        C = np.array([1.2, 1.3, 0])

        triangle = Polygon(
            A, B, C,
            color=CYAN,
            stroke_width=4,
            fill_color=CYAN,
            fill_opacity=0.08,
        )
        right_angle = RightAngle(
            Line(B, A), Line(B, C), length=0.28, color=MUTED
        )

        label_a = Text("a", font_size=30, color=AMBER).next_to(Line(A, B), DOWN, buff=0.18)
        label_b = Text("b", font_size=30, color=VIOLET).next_to(Line(B, C), RIGHT, buff=0.18)
        label_c = Text("c", font_size=30, color=CYAN).next_to(Line(C, A), UP, buff=0.2)

        self.play(Create(triangle), run_time=1.2)
        self.play(Create(right_angle), FadeIn(label_a), FadeIn(label_b), FadeIn(label_c), run_time=0.8)
        self.wait(0.6)

        formula = Text("a² + b² = c²", font_size=54, color=WHITE)
        formula.next_to(triangle, DOWN, buff=0.45)
        self.play(Write(formula), run_time=1.2)
        self.wait(0.8)

        highlight = Text("El cuadrado de la hipotenusa", font_size=30, color=CYAN)
        highlight.next_to(formula, DOWN, buff=0.35)
        highlight2 = Text("es la suma de los cuadrados de los catetos", font_size=26, color=MUTED)
        highlight2.next_to(highlight, DOWN, buff=0.18)
        self.play(FadeIn(highlight, shift=UP * 0.2), FadeIn(highlight2, shift=UP * 0.2), run_time=1.0)
        self.wait(1.2)

        self.play(
            FadeOut(highlight),
            FadeOut(highlight2),
            FadeOut(formula),
            FadeOut(label_a),
            FadeOut(label_b),
            FadeOut(label_c),
            FadeOut(right_angle),
            FadeOut(triangle),
            FadeOut(plane),
            FadeOut(title),
            run_time=1.0,
        )
